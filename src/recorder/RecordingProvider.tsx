import { Constants } from "@/common/constants";
import { Chunk, Meeting } from "@/common/model";
import {
    buildChunk,
    moveChunkFileToDocumentsDirectoryAsync,
} from "@/common/utils";
import { dbManager } from "@/database/dbManager";
import useLiveMeeting from "@/hooks/useLiveMeeting";
import { transcriptionQueue } from "@/transcriptor/transcriptionQueue";
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
        (async () => {
            await setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: true,
                allowsBackgroundRecording: true,
            });
        })();

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (liveMeeting && liveMeeting.meetingId) {
            currentMeetingIdRef.current = liveMeeting.meetingId;
            setRecorderState("paused");
        }
    }, [liveMeeting]);

    const getActiveRecorder = useCallback(
        () => (activeRecorderRef.current === "A" ? recorderA : recorderB),
        [recorderA, recorderB],
    );

    const toggleActiveRecorder = useCallback(() => {
        activeRecorderRef.current =
            activeRecorderRef.current === "A" ? "B" : "A";
    }, []);

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

        // create a new meeting in database
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

        // prepae and start recording
        if (!recorderA.isRecording) {
            try {
                await recorderA.prepareToRecordAsync();
                recorderA.record();

                // capture the current recording state
                setRecorderState("recording");
                activeRecorderRef.current = "A";
                startTimeTrackerRef.current[recorderA.id] =
                    new Date().toTimeString();
            } catch (e) {
                alert(JSON.stringify(e));
            }
        }

        //always clear interval before staring a new one
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // create a new interval that toggle recorders on every
        intervalRef.current = setInterval(async () => {
            // make previous chunk recorder an active recorder
            const prevRecorder = getActiveRecorder();
            toggleActiveRecorder();
            const currRecorder = getActiveRecorder();

            if (!currRecorder.isRecording) {
                try {
                    await currRecorder.prepareToRecordAsync();
                    currRecorder.record();
                    startTimeTrackerRef.current[currRecorder.id] =
                        new Date().toTimeString();
                    setTimeout(async () => {
                        if (prevRecorder.isRecording) {
                            await stopRecorderAndMoveFileAsync(prevRecorder);
                        }
                    }, Constants.CHUNK_OVERLAP_MS);
                } catch (e) {
                    alert(JSON.stringify(e));
                }
            }
        }, Constants.CHUNK_DURATION_MS - Constants.CHUNK_OVERLAP_MS);
    }, [getActiveRecorder, recorderA, recorderB, toggleActiveRecorder]);

    const stopRecorderAndMoveFileAsync = useCallback(
        async (recorder: AudioRecorder) => {
            if (recorder.isRecording) {
                await recorder.stop();
                const startTime = startTimeTrackerRef.current[recorder.id];
                const endTime = new Date().toTimeString();
                const fileUri = recorder.uri;
                if (fileUri) {
                    const chunkUri =
                        await moveChunkFileToDocumentsDirectoryAsync(fileUri);
                    if (chunkUri) {
                        const meetingId = currentMeetingIdRef.current;
                        if (meetingId) {
                            const chunk: Chunk = buildChunk(
                                meetingId,
                                chunkUri,
                                startTime,
                                endTime,
                            );
                            await dbManager.saveChunk(chunk);
                            void transcriptionQueue.enqueueChunk(chunk);
                        }
                    }
                }
            }
        },
        [],
    );

    const cleanUp = useCallback(async () => {
        // cleanup timers
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // stop recorders
        await stopRecorderAndMoveFileAsync(recorderA);
        await stopRecorderAndMoveFileAsync(recorderB);
    }, [recorderA, recorderB, stopRecorderAndMoveFileAsync]);

    const pauseMeeting = useCallback(async () => {
        await cleanUp();
        setRecorderState("paused");
    }, [cleanUp]);

    const stopMeeting = useCallback(async () => {
        await cleanUp();

        // update data base with end time before setting currentMeetingId to null
        if (currentMeetingIdRef.current) {
            await dbManager.updateMeetingEndTime(
                currentMeetingIdRef.current,
                new Date().toLocaleTimeString(),
            );
        }
        currentMeetingIdRef.current = null;

        // finally ser the recorder state to stopped
        setRecorderState("stopped");
    }, [cleanUp]);

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
