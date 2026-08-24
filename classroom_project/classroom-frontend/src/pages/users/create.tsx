import { CreateView } from "@/components/refine-ui/views/create-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import UserForm from "@/pages/users/form.tsx";

const Create = () => {
  return (
    <CreateView className="class-view">
      <Breadcrumb />

      <h1 className="page-title">Create a User</h1>
      <div className="intro-row">
        <p>Provide the required information below to add a user.</p>
      </div>

      <Separator />

      <UserForm action="create" />
    </CreateView>
  );
};

export default Create;
