import { EditView, EditViewHeader } from "@/components/refine-ui/views/edit-view.tsx";
import UserForm from "@/pages/users/form.tsx";

const Edit = () => {
  return (
    <EditView className="class-view">
      <EditViewHeader resource="users" title="Edit User" />
      <UserForm action="edit" />
    </EditView>
  );
};

export default Edit;
