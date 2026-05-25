import { useRecorderContext } from "@/common/RecordingProvider";
import { dbManager } from "@/common/dbManager";
import { Chunk, Meeting } from "@/common/model";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Button,
    FlatList,
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

export default function Transcription() {
    const params = useLocalSearchParams() as { meetingId?: string };
    const {
        startMeeting,
        pauseMeeting,
        stopMeeting,
        currentMeetingId,
        isRecording,
    } = useRecorderContext();

    let { meetingId = null } = params;

    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [chunks, setChunks] = useState<Chunk[] | null>(null);

    const shouldStartMeeting = !(meetingId || currentMeetingId || isRecording);

    const isLiveMeeting =
        isRecording &&
        currentMeetingId &&
        (!meetingId || meetingId == currentMeetingId);

    if (!meetingId) meetingId = currentMeetingId;

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
        if (shouldStartMeeting) {
            void startMeeting();
        }
    }, []);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isRecording) {
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
    }, [loadChunks, loadMeeting, isRecording]);

    const onPause = useCallback(() => {
        void pauseMeeting();
    }, [pauseMeeting]);

    const onStop = useCallback(() => {
        void stopMeeting();
    }, [stopMeeting]);

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
                        {meeting?.startTime} -{" "}
                        {meeting?.endTime ?? "Live recording"}
                    </Text>
                    {isLiveMeeting ? (
                        <View style={styles.liveBadgeContainer}>
                            <Text style={styles.liveBadge}>
                                I am listening and taking notes
                            </Text>
                            <ActivityIndicator size="large" />
                        </View>
                    ) : null}
                </View>

                {chunks && chunks.length > 0 ? (
                    <FlatList
                        data={chunks}
                        keyExtractor={(item) => item.chunkId}
                        renderItem={({ item }) => (
                            <View style={styles.chunkCard}>
                                <Text style={styles.chunkHeader}>
                                    {item.startTime} - {item.endTime}
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
                    <View style={styles.pauseBtn}>
                        <Button title="Pause" color="#fff" onPress={onPause} />
                    </View>
                    <View style={styles.stopBtn}>
                        <Button title="Stop" color="#fff" onPress={onStop} />
                    </View>
                </View>
            ) : null}
        </View>
    );
}
