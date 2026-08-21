import { CreateView } from "@/components/refine-ui/views/create-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useBack } from "@refinedev/core";
import { Separator } from "@/components/ui/separator.tsx";
import { useIsAdmin } from "@/hooks/use-is-admin.ts";
import SubjectForm from "@/pages/subjects/form.tsx";

const SubjectsCreate = () => {
  const back = useBack();
  const { isAdmin } = useIsAdmin();

  if (!isAdmin) {
    return (
      <CreateView className="class-view">
        <Breadcrumb />
        <div className="flex flex-col items-center justify-center py-12">
          <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You don't have permission to create subjects.
          </p>
          <Button onClick={() => back()}>Go Back</Button>
        </div>
      </CreateView>
    );
  }

  return (
    <CreateView className="class-view">
      <Breadcrumb />

      <h1 className="page-title">Create a Subject</h1>
      <div className="intro-row">
        <p>Provide the required information below to add a subject.</p>
        <Button onClick={() => back()}>Go Back</Button>
      </div>

      <Separator />

      <SubjectForm action="create" />
    </CreateView>
  );
};

export default SubjectsCreate;
