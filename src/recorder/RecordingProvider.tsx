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
import BackgroundTimer, { TimeoutId } from "react-native-background-timer";

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
    liveMeetingId: string | null;
};

const RecorderContext = createContext<RecorderContextValue | undefined>(
    undefined,
);

export function RecordingProvider({ children }: { children: ReactNode }) {
    const recorderA = useAudioRecorder(RECORDING_OPTIONS);
    const recorderB = useAudioRecorder(RECORDING_OPTIONS);
    const activeRecorderRef = useRef<"A" | "B">("A");
    const timeoutIdRef = useRef<TimeoutId | null>(null);
    const startTimeTrackerRef = useRef<Record<string, string>>({});
    let liveMeetingIdRef = useRef<string | null>(null);
    const [recorderState, setRecorderState] = useState<RecorderState>(null);
    const { liveMeeting } = useLiveMeeting();

    useEffect(() => {
        void setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: true,
            allowsBackgroundRecording: true,
        });

        return () => {
            BackgroundTimer.stopBackgroundTimer();
            timeoutIdRef.current &&
                BackgroundTimer.clearTimeout(timeoutIdRef.current);
        };
    }, []);

    /*
     *  this effect handles the app restart case
     *  setting meetingId to previous app session's live meeting
     *  and keep it in paused state
     */
    useEffect(() => {
        if (liveMeeting?.meetingId) {
            liveMeetingIdRef.current = liveMeeting.meetingId;
            setRecorderState("paused");
        }
    }, [liveMeeting?.meetingId]);

    const getActiveRecorder = () =>
        activeRecorderRef.current === "A" ? recorderA : recorderB;

    const toggleActiveRecorder = () => {
        activeRecorderRef.current =
            activeRecorderRef.current === "A" ? "B" : "A";
    };

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

        try {
            // creates a new meeting in database only if there is no life meeting
            if (!liveMeetingIdRef.current) {
                const dateObj = new Date();
                liveMeetingIdRef.current = `Meeting_${dateObj.getTime()}`;
                const meeting: Meeting = {
                    meetingId: liveMeetingIdRef.current,
                    date: dateObj.toDateString(),
                    startTime: dateObj.toLocaleTimeString(),
                    endTime: null,
                };
                await dbManager.saveMeeting(meeting);
            }

            // prepare and start recording
            if (!recorderA.isRecording) {
                await recorderA.prepareToRecordAsync();
                recorderA.record();

                // capture the current recording state
                setRecorderState("recording");
                activeRecorderRef.current = "A";
                startTimeTrackerRef.current[recorderA.id] =
                    new Date().toTimeString();
            }

            //always clear interval before staring a new one
            BackgroundTimer.stopBackgroundTimer();

            // create a new interval that toggle recorders on every
            BackgroundTimer.runBackgroundTimer(async () => {
                // make previous chunk recorder an active recorder
                const prevRecorder = getActiveRecorder();
                toggleActiveRecorder();
                const currRecorder = getActiveRecorder();

                if (!currRecorder.isRecording) {
                    await currRecorder.prepareToRecordAsync();
                    currRecorder.record();
                    startTimeTrackerRef.current[currRecorder.id] =
                        new Date().toTimeString();
                    timeoutIdRef.current = BackgroundTimer.setTimeout(
                        async () => {
                            if (prevRecorder.isRecording) {
                                stopRecorderAndSaveChunk(prevRecorder);
                            }
                            timeoutIdRef.current &&
                                BackgroundTimer.clearTimeout(
                                    timeoutIdRef.current,
                                );
                        },
                        Constants.CHUNK_OVERLAP_MS,
                    );
                }
            }, Constants.CHUNK_DURATION_MS - Constants.CHUNK_OVERLAP_MS);
        } catch (e) {
            __DEV__ && console.log("error in startMeeting", e);
        }
    }, []);

    const stopRecorderAndSaveChunk = async (recorder: AudioRecorder) => {
        try {
            if (recorder.isRecording) {
                recorder.stop();
                const startTime = startTimeTrackerRef.current[recorder.id];
                const endTime = new Date().toTimeString();
                const fileUri = recorder.uri;
                if (fileUri) {
                    const chunkUri =
                        await moveChunkFileToDocumentsDirectoryAsync(fileUri);
                    if (chunkUri) {
                        const meetingId = liveMeetingIdRef.current;
                        if (meetingId) {
                            const chunk: Chunk = buildChunk(
                                meetingId,
                                chunkUri,
                                startTime,
                                endTime,
                            );
                            await dbManager.saveChunk(chunk);
                            transcriptionQueue.enqueueChunk(chunk);
                        }
                    }
                }
            }
        } catch (e) {
            __DEV__ && console.log("error in stopRecorderAndSaveChunk", e);
        }
    };

    const updateEndTimeAndClearLiveMeeting = () => {
        // update data base with end time before setting liveMeetingId to null
        if (liveMeetingIdRef.current) {
            void dbManager.updateMeetingEndTime(
                liveMeetingIdRef.current,
                new Date().toLocaleTimeString(),
            );
        }
        liveMeetingIdRef.current = null;
    };

    const cleanUp = () => {
        // cleanup timers
        BackgroundTimer.stopBackgroundTimer();
        timeoutIdRef.current &&
            BackgroundTimer.clearTimeout(timeoutIdRef.current);

        // stop recorders
        void stopRecorderAndSaveChunk(recorderA);
        void stopRecorderAndSaveChunk(recorderB);
    };

    const pauseMeeting = useCallback(async () => {
        cleanUp();
        setRecorderState("paused");
    }, []);

    const stopMeeting = useCallback(async () => {
        cleanUp();
        updateEndTimeAndClearLiveMeeting();
        setRecorderState("stopped");
    }, []);

    const value = useMemo(
        () => ({
            startMeeting,
            pauseMeeting,
            stopMeeting,
            recorderState,
            liveMeetingId: liveMeetingIdRef.current,
        }),
        [
            startMeeting,
            pauseMeeting,
            stopMeeting,
            recorderState,
            liveMeetingIdRef.current,
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
