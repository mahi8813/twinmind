import { RecordingProvider } from "@/common/RecordingProvider";
import { transcriptionQueue } from "../common/transcriptionQueue";
import { Stack } from "expo-router";
import React, { useEffect } from "react";

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
