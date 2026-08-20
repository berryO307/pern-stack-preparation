import { EditView, EditViewHeader } from "@/components/refine-ui/views/edit-view.tsx";
import DepartmentForm from "@/pages/departments/form.tsx";

const Edit = () => {
  return (
    <EditView className="class-view">
      <EditViewHeader resource="departments" title="Edit Department" />
      <DepartmentForm action="edit" />
    </EditView>
  );
};

export default Edit;
