import { CreateView } from "@/components/refine-ui/views/create-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import SubjectForm from "@/pages/subjects/form.tsx";

const SubjectsCreate = () => {
  return (
    <CreateView className="class-view">
      <Breadcrumb />

      <h1 className="page-title">Create a Subject</h1>
      <div className="intro-row">
        <p>Provide the required information below to add a subject.</p>
      </div>

      <Separator />

      <SubjectForm action="create" />
    </CreateView>
  );
};

export default SubjectsCreate;
