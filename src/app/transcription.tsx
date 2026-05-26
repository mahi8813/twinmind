import { Chunk, Meeting } from "@/common/model";
import ActiveRecordingIndicator from "@/components/activeRecordingIndicator";
import PausedRecordingIndicator from "@/components/pausedRecordingIndicator";
import { dbManager } from "@/database/dbManager";
import { useRecorderContext } from "@/recorder/RecordingProvider";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    Button,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: "#fff",
    },
    bottomBar: {
        alignSelf: "center",
        position: "absolute",
        flexDirection: "row",
        bottom: 50,
        backgroundColor: "#05284e",
        borderRadius: 25,
        overflow: "hidden",
        padding: 8,
    },
    pauseBtn: {
        marginRight: 20,
        backgroundColor: "#05284e",
    },
    stopBtn: {
        backgroundColor: "#ef0d0d",
        borderRadius: 25,
    },
    header: {
        marginBottom: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: "#555",
    },
    chunkCard: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        backgroundColor: "#f8f8f8",
    },
    chunkHeader: {
        fontWeight: "bold",
        marginBottom: 6,
    },
    chunkText: {
        fontSize: 16,
        lineHeight: 22,
    },
    liveBadgeContainer: {
        flexDirection: "row",
        justifyContent: "flex-start",
    },
    liveBadge: {
        color: "#0b6623",
        fontWeight: "bold",
        fontSize: 20,
    },
});

const STP_BTN_COLOR = Platform.OS === "ios" ? "#fff" : "#ef0d0d";
const PAUSE_BTN_COLOR = Platform.OS === "ios" ? "#fff" : "#05284e";

export default function Transcription() {
    const params = useLocalSearchParams() as { meetingId?: string };
    const {
        startMeeting,
        pauseMeeting,
        stopMeeting,
        currentMeetingId,
        recorderState,
    } = useRecorderContext();

    let { meetingId = null } = params;

    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [chunks, setChunks] = useState<Chunk[] | null>(null);
    const router = useRouter();

    const isLiveMeeting = currentMeetingId && meetingId === currentMeetingId;
    const isMeetingPaused = isLiveMeeting && recorderState === "paused";

    useEffect(() => {
        if (!meetingId && currentMeetingId) {
            router.setParams({ meetingId: currentMeetingId });
        }
    }, [meetingId, currentMeetingId, router]);

    const loadChunks = useCallback(async () => {
        if (!meetingId) return;
        const meetingChunks: Chunk[] =
            await dbManager.getChunksByMeetingId(meetingId);

        setChunks(
            meetingChunks
                .slice()
                .sort((a: Chunk, b: Chunk) =>
                    b.startTime.localeCompare(a.startTime),
                ),
        );
    }, [meetingId]);

    const loadMeeting = useCallback(async () => {
        if (!meetingId) return;
        const meeting = await dbManager.getMeetingById(meetingId);
        setMeeting(meeting);
    }, [meetingId]);

    useEffect(() => {
        if (!meetingId) {
            void startMeeting();
        }
    }, []);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (recorderState === "recording") {
            void Promise.all([loadMeeting(), loadChunks()]);
            interval = setInterval(async () => {
                loadChunks();
            }, 5000);
        } else {
            void Promise.all([loadMeeting(), loadChunks()]);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [loadChunks, loadMeeting, recorderState]);

    const onPause = useCallback(() => {
        void pauseMeeting();
    }, [pauseMeeting]);

    const onStop = useCallback(() => {
        void stopMeeting();
    }, [stopMeeting]);

    const onResume = useCallback(() => {
        void startMeeting();
    }, []);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: isLiveMeeting ? `${meetingId}` : "Transcription",
                }}
            />
            <>
                <View style={styles.header}>
                    <Text style={styles.title}>{meetingId}</Text>
                    <Text style={styles.subtitle}>
                        {meeting?.date ?? "Unknown date"}
                    </Text>
                    <Text style={styles.subtitle}>
                        {meeting?.startTime} - {meeting?.endTime ?? "Live"}
                    </Text>
                    {isLiveMeeting ? (
                        isMeetingPaused ? (
                            <PausedRecordingIndicator />
                        ) : (
                            <ActiveRecordingIndicator />
                        )
                    ) : null}
                </View>

                {chunks && chunks.length > 0 ? (
                    <FlatList
                        data={chunks}
                        keyExtractor={(item) => item.chunkId}
                        renderItem={({ item }) => (
                            <View style={styles.chunkCard}>
                                <Text style={styles.chunkHeader}>
                                    {item.startTime.slice(0, 8)} -{" "}
                                    {item.endTime.slice(0, 8)}
                                </Text>
                                <Text style={styles.chunkText}>
                                    {item.transcription ?? "Transcribing..."}
                                </Text>
                            </View>
                        )}
                    />
                ) : (
                    <Text>No transcriptions available yet.</Text>
                )}
            </>
            {isLiveMeeting ? (
                <View style={styles.bottomBar}>
                    {isMeetingPaused ? (
                        <View style={styles.pauseBtn}>
                            <Button
                                title="Resume"
                                color={PAUSE_BTN_COLOR}
                                onPress={onResume}
                            />
                        </View>
                    ) : (
                        <View style={styles.pauseBtn}>
                            <Button
                                title="Pause"
                                color={PAUSE_BTN_COLOR}
                                onPress={onPause}
                            />
                        </View>
                    )}

                    <View style={styles.stopBtn}>
                        <Button
                            title="Stop"
                            color={STP_BTN_COLOR}
                            onPress={onStop}
                        />
                    </View>
                </View>
            ) : null}
        </View>
    );
}
