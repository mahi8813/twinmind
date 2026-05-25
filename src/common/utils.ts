import * as FileSystem from "expo-file-system/legacy";
import { Chunk } from "./model";

export type ChunkHandler = (
    chunkUri: string,
    startTime: string,
    endTime: string,
) => void;

export const moveChunkFileToDocumentsDirectoryAsync = async (
    chunkUri: string,
): Promise<string> => {
    // 1. Get info and MD5 of the created file
    let sourceInfo = await FileSystem.getInfoAsync(chunkUri, { md5: true });
    if (!sourceInfo.exists) {
        return "";
    }

    try {
        const uniqueFileName = `recording-${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 10)}.m4a`;
        const customFilePath = `${FileSystem.documentDirectory}${uniqueFileName}`;

        await FileSystem.moveAsync({
            from: chunkUri,
            to: customFilePath,
        });
        return customFilePath;
    } catch (error) {
        console.error("Error moving file:", error);
        throw error;
    }
};

export const deleteChunkFileFromDocumentsDirectoryAsync = async (
    chunkUri: string,
): Promise<void> => {
    return await FileSystem.deleteAsync(chunkUri);
};

export const buildChunk = (
    meetingId: string,
    chunkUri: string,
    startTime: string,
    endTime: string,
): Chunk => ({
    chunkId: `${meetingId}_Chunk_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 10)}`,
    meetingId,
    uri: chunkUri,
    startTime,
    endTime,
    status: "queued",
    transcription: null,
});
