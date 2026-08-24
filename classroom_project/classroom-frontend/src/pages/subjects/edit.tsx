import { EditView, EditViewHeader } from "@/components/refine-ui/views/edit-view.tsx";
import SubjectForm from "@/pages/subjects/form.tsx";

const Edit = () => {
  return (
    <EditView className="class-view">
      <EditViewHeader resource="subjects" title="Edit Subject" />
      <SubjectForm action="edit" />
    </EditView>
  );
};

export default Edit;
