import { Meeting } from "@/common/model";
import { dbManager } from "@/database/dbManager";
import { useEffect, useState } from "react";

export default function useLiveMeeting() {
    const [liveMeeting, setLiveMeeting] = useState<Meeting | null>(null);

    useEffect(() => {
        const fetchLiveMeeting = async () => {
            const liveMeeting = await dbManager.getLiveMeeting();
            setLiveMeeting(liveMeeting);
        };
        void fetchLiveMeeting();
    }, []);

    return { liveMeeting };
}
