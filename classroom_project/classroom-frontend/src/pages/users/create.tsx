import { CreateView } from "@/components/refine-ui/views/create-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useBack } from "@refinedev/core";
import { Separator } from "@/components/ui/separator.tsx";
import UserForm from "@/pages/users/form.tsx";

const Create = () => {
  const back = useBack();

  return (
    <CreateView className="class-view">
      <Breadcrumb />

      <h1 className="page-title">Create a User</h1>
      <div className="intro-row">
        <p>Provide the required information below to add a user.</p>
        <Button onClick={() => back()}>Go Back</Button>
      </div>

      <Separator />

      <UserForm action="create" />
    </CreateView>
  );
};

export default Create;
