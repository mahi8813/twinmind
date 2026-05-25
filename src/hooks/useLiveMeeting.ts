import { Meeting } from "@/common/model";
import { dbManager } from "@/database/dbManager";
import { useCallback, useEffect, useState } from "react";

export default function useLiveMeeting() {
    const [liveMeeting, setLiveMeeting] = useState<Meeting | null>(null);

    const fetchLiveMeeting = useCallback(async () => {
        const liveMeeting = await dbManager.getLiveMeeting();
        setLiveMeeting(liveMeeting);
    }, []);

    useEffect(() => {
        void fetchLiveMeeting();
    }, [fetchLiveMeeting]);

    return { liveMeeting };
}
