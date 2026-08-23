import UsersList from "@/pages/users/list.tsx";

// Faculty is a filtered lens onto the Users resource (role = teacher), reusing
// the same list/create/edit/show pages rather than duplicating CRUD for a
// role that lives in the same `user` table.
const FacultyList = () => (
  <UsersList
    title="Faculty"
    subtitle="Browse and manage faculty members"
    defaultRole="teacher"
    emptyStateNoun="faculty members"
  />
);

export default FacultyList;
