import { CreateView } from "@/components/refine-ui/views/create-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useBack } from "@refinedev/core";
import { Separator } from "@/components/ui/separator.tsx";
import EnrollmentForm from "@/pages/enrollments/form.tsx";

const EnrollmentsCreate = () => {
  const back = useBack();

  return (
    <CreateView className="class-view">
      <Breadcrumb />

      <h1 className="page-title">Enroll a Student</h1>
      <div className="intro-row">
        <p>Assign a student to a class roster.</p>
        <Button onClick={() => back()}>Go Back</Button>
      </div>

      <Separator />

      <EnrollmentForm />
    </CreateView>
  );
};

export default EnrollmentsCreate;
