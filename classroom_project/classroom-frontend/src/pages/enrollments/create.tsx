import { CreateView } from "@/components/refine-ui/views/create-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import EnrollmentForm from "@/pages/enrollments/form.tsx";

const EnrollmentsCreate = () => {
  return (
    <CreateView className="class-view">
      <Breadcrumb />

      <h1 className="page-title">Enroll in a class</h1>
      <div className="intro-row">
        <p>Select a class to enroll as the current user.</p>
      </div>

      <EnrollmentForm />
    </CreateView>
  );
};

export default EnrollmentsCreate;
