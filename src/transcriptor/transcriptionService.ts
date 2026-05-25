import { Constants } from "../common/constants";

export async function transcribeAudio(fileUri: string) {
    try {
        const formData = new FormData();
        formData.append("file", {
            uri: fileUri,
            name: "recording.m4a",
            type: "audio/m4a",
        } as any);
        formData.append("model", "whisper-large-v3");

        const response = await fetch(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${Constants.GROK_API_KEY}`,
                },
                body: formData,
            },
        );

        const data = await response.json();
        return data.text;
    } catch (error) {
        console.error("Groq Transcription Error:", error);
        throw error;
    }
}
