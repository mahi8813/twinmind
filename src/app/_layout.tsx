import { RecordingProvider } from "@/recorder/RecordingProvider";
import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { transcriptionQueue } from "../transcriptor/transcriptionQueue";

export default function RootLayout() {
    useEffect(() => {
        void transcriptionQueue.start();
    }, []);

    return (
        <RecordingProvider>
            <Stack />
        </RecordingProvider>
    );
}
