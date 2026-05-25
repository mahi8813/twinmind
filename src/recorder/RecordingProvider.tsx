import { Constants } from "@/common/constants";
import { Chunk, Meeting } from "@/common/model";
import {
    buildChunk,
    moveChunkFileToDocumentsDirectoryAsync,
} from "@/common/utils";
import { dbManager } from "@/database/dbManager";
import useLiveMeeting from "@/hooks/useLiveMeeting";
import {
    AudioRecorder,
    getRecordingPermissionsAsync,
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
} from "expo-audio";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { transcriptionQueue } from "../transcriptor/transcriptionQueue";

const RECORDING_OPTIONS = Object.freeze({
    ...RecordingPresets.HIGH_QUALITY,
    numberOfChannels: 1,
});

type RecorderState = "recording" | "paused" | "stopped" | null;
type RecorderContextValue = {
    startMeeting: () => Promise<void>;
    pauseMeeting: () => Promise<void>;
    stopMeeting: () => Promise<void>;
    recorderState: RecorderState;
    currentMeetingId: string | null;
};

const RecorderContext = createContext<RecorderContextValue | undefined>(
    undefined,
);

export function RecordingProvider({ children }: { children: ReactNode }) {
    const recorderA = useAudioRecorder(RECORDING_OPTIONS);
    const recorderB = useAudioRecorder(RECORDING_OPTIONS);
    const activeRecorderRef = useRef<"A" | "B">("A");
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeTrackerRef = useRef<Record<string, string>>({});
    let currentMeetingIdRef = useRef<string | null>(null);
    const [recorderState, setRecorderState] = useState<RecorderState>(null);
    const { liveMeeting } = useLiveMeeting();

    useEffect(() => {
        if (liveMeeting && liveMeeting.meetingId) {
            currentMeetingIdRef.current = liveMeeting.meetingId;
            setRecorderState("paused");
        }
    }, [liveMeeting]);

    const setRecordingState = useCallback((value: RecorderState) => {
        setRecorderState(value);
    }, []);

    const getActiveRecorder = useCallback(
        () => (activeRecorderRef.current === "A" ? recorderA : recorderB),
        [recorderA, recorderB],
    );

    const toggleActiveRecorder = useCallback(() => {
        activeRecorderRef.current =
            activeRecorderRef.current === "A" ? "B" : "A";
    }, []);

    const stopRecorderAndMoveFileAsync = useCallback(
        async (recorder: AudioRecorder) => {
            const meetingId = currentMeetingIdRef.current;
            if (!meetingId) {
                return;
            }

            await recorder.stop();
            const startTime = startTimeTrackerRef.current[recorder.id];
            const endTime = new Date().toTimeString();
            const fileUri = recorder.uri;
            if (!fileUri) {
                return;
            }

            const chunkUri =
                await moveChunkFileToDocumentsDirectoryAsync(fileUri);
            const chunk: Chunk = buildChunk(
                meetingId,
                chunkUri,
                startTime,
                endTime,
            );
            await dbManager.saveChunk(chunk);
            void transcriptionQueue.enqueueChunk(chunk);
        },
        [],
    );

    const cleanUp = useCallback(async () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (recorderA.isRecording) {
            await stopRecorderAndMoveFileAsync(recorderA);
        }
        if (recorderB.isRecording) {
            await stopRecorderAndMoveFileAsync(recorderB);
        }
    }, [recorderA, recorderB, stopRecorderAndMoveFileAsync]);

    const startMeeting = useCallback(async () => {
        if (recorderState == "recording") {
            return;
        }

        const hasPermission = await getRecordingPermissionsAsync().then(
            async ({ status }) =>
                status === "granted" ||
                (await requestRecordingPermissionsAsync()).granted,
        );

        if (!hasPermission) {
            alert("Permission to access microphone was denied");
            return;
        }

        if (!currentMeetingIdRef.current) {
            const dateObj = new Date();
            currentMeetingIdRef.current = `Meeting_${dateObj.getTime()}`;
            const meeting: Meeting = {
                meetingId: currentMeetingIdRef.current,
                date: dateObj.toDateString(),
                startTime: dateObj.toLocaleTimeString(),
                endTime: null,
            };
            await dbManager.saveMeeting(meeting);
        }

        await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: true,
            allowsBackgroundRecording: true,
        });

        await recorderA.prepareToRecordAsync();
        await recorderB.prepareToRecordAsync();

        setRecordingState("recording");
        activeRecorderRef.current = "A";
        startTimeTrackerRef.current[recorderA.id] = new Date().toTimeString();
        recorderA.record();

        intervalRef.current = setInterval(async () => {
            const previousRecorder = getActiveRecorder();
            toggleActiveRecorder();
            const activeRecorder = getActiveRecorder();
            await activeRecorder.prepareToRecordAsync();
            startTimeTrackerRef.current[activeRecorder.id] =
                new Date().toTimeString();
            activeRecorder.record();
            setTimeout(async () => {
                await stopRecorderAndMoveFileAsync(previousRecorder);
            }, Constants.CHUNK_OVERLAP_MS);
        }, Constants.CHUNK_DURATION_MS - Constants.CHUNK_OVERLAP_MS);
    }, [getActiveRecorder, recorderA, recorderB, toggleActiveRecorder]);

    const pauseMeeting = useCallback(async () => {
        await cleanUp();
        setRecordingState("paused");
    }, [cleanUp]);

    const stopMeeting = useCallback(async () => {
        if (currentMeetingIdRef.current) {
            await dbManager.updateMeetingEndTime(
                currentMeetingIdRef.current,
                new Date().toLocaleTimeString(),
            );
            currentMeetingIdRef.current = null;
        }

        await cleanUp();
        setRecordingState("stopped");
    }, [cleanUp]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);

    const value = useMemo(
        () => ({
            startMeeting,
            pauseMeeting,
            stopMeeting,
            recorderState,
            currentMeetingId: currentMeetingIdRef.current,
        }),
        [
            startMeeting,
            pauseMeeting,
            stopMeeting,
            recorderState,
            currentMeetingIdRef.current,
        ],
    );

    return (
        <RecorderContext.Provider value={value}>
            {children}
        </RecorderContext.Provider>
    );
}

export function useRecorderContext() {
    const context = useContext(RecorderContext);
    if (!context) {
        throw new Error(
            "useRecorderContext must be used within a RecordingProvider",
        );
    }
    return context;
}
