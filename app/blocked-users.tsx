import BlockedUsersScreen from '@/features/profile/components/BlockedUsersScreen';
import { BackgroundProvider } from '@/contexts/BackgroundContext';

export default function BlockedUsersRoute() {
    return (
        <BackgroundProvider>
            <BlockedUsersScreen />
        </BackgroundProvider>
    );
}
