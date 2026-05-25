import { useRecorderContext } from "@/common/RecordingProvider";
import NotesList from "@/components/notesList";
import useMeetings from "@/hooks/useMeetings";
import { Stack, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
    },
    btmBarContainer: {
        position: "absolute",
        borderRadius: 25,
        bottom: 50,
        width: 200,
        backgroundColor: "#05284e",
    },
    toastContainer: {
        height: 50,
        justifyContent: "center",
        backgroundColor: "#b5b5b5",
        alignSelf: "stretch",
        alignItems: "center",
    },
    toastTextView: {
        fontWeight: "bold",
        fontSize: 24,
    },
});

export default function History() {
    const router = useRouter();
    const meetings = useMeetings();
    const { pauseMeeting, stopMeeting, isRecording } = useRecorderContext();

    // events
    const onRecordPress = useCallback(async () => {
        router.push("/transcription");
    }, [router]);

    const onMeetingPress = useCallback(
        (meetingId: string) => {
            router.push(`/transcription?meetingId=${meetingId}` as any);
        },
        [router],
    );

    const onStopPress = useCallback(async () => {
        await stopMeeting();
    }, [stopMeeting]);

    const renderNoMeetingsView = () => {
        return (
            <>
                <Text>No Recorded Meetings</Text>
                <Text>Click on Record Notes & start a new meeting"</Text>
            </>
        );
    };

    const renderNotesList = () => {
        return (
            <>
                {isRecording ? (
                    <View style={styles.toastContainer}>
                        <Text style={styles.toastTextView}>
                            I am Listening and taking Notes...
                        </Text>
                    </View>
                ) : null}
                <NotesList
                    meetings={meetings ?? []}
                    onMeetingPress={onMeetingPress}
                />
            </>
        );
    };

    const renderLoadingView = () => {
        return <Text>Loading your Meetings...</Text>;
    };

    const renderBottomBar = () => {
        return isRecording ? (
            <View style={styles.btmBarContainer}>
                <Button title="Stop" color="#fff" onPress={onStopPress} />
            </View>
        ) : (
            <View style={styles.btmBarContainer}>
                <Button
                    title="Record Notes"
                    color="#fff"
                    onPress={onRecordPress}
                />
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: "History" }} />
            {meetings
                ? meetings.length > 0
                    ? renderNotesList()
                    : renderNoMeetingsView()
                : renderLoadingView()}
            {renderBottomBar()}
        </View>
    );
}
