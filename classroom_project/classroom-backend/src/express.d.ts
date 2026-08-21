declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                role?: 'admin' | 'teacher' | 'student';
            }
            // Set by middleware/workspace.ts once the caller's demo workspace has
            // been resolved (provisioning/reseeding it first if needed).
            workspaceId?: string;
        }
    }
}

export {};