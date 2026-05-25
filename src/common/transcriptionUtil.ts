import { Constants } from "./constants";

export async function transcribeAudio(fileUri: string) {
    const cleanUri = fileUri.replace("file://", "");

    const formData = new FormData();
    formData.append("file", {
        uri: cleanUri,
        name: "recording.m4a",
        type: "audio/m4a",
    } as any);

    formData.append("model", "whisper-large-v3");

    try {
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
