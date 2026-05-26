import { RecordingProvider } from "@/recorder/RecordingProvider";
import { useNetworkState } from "expo-network";
import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { transcriptionQueue } from "../transcriptor/transcriptionQueue";

const TOAST_COLOR = Platform.OS === "ios" ? "white" : "#791c1c";

const styles = StyleSheet.create({
    toastBox: {
        backgroundColor: "#791c1c",
        borderRadius: 25,
        position: "absolute",
        bottom: 16,
        padding: 8,
        alignSelf: "center",
        justifyContent: "center",
    },
    toastText: {
        color: "#fff",
    },
});

export default function RootLayout() {
    const networkState = useNetworkState();

    useEffect(() => {
        if (networkState.isInternetReachable) {
            void transcriptionQueue.start();
        } else {
            void transcriptionQueue.stop();
        }
    }, [networkState]);

    return (
        <RecordingProvider>
            <Stack />
            {!networkState.isInternetReachable ? (
                <View style={styles.toastBox}>
                    <Text style={styles.toastText}>
                        Not connected to internet. Transcriptions will not be
                        available{" "}
                    </Text>
                </View>
            ) : null}
        </RecordingProvider>
    );
}
