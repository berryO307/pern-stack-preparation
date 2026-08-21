import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import { userSchema } from "@/lib/schema.ts";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Loader2 } from "lucide-react";
import UploadWidget from "@/components/upload-widget.tsx";
import type { UploadWidgetValue } from "@/types";
import { ROLE_OPTIONS } from "@/constants";

type UserFormProps = {
  action: "create" | "edit";
};

const UserForm = ({ action }: UserFormProps) => {
  const form = useForm({
    resolver: zodResolver(userSchema),
    refineCoreProps: {
      resource: "users",
      action,
    },
  });

  const {
    handleSubmit,
    control,
    refineCore: { onFinish, formLoading, query },
  } = form;

  const isLoadingRecord = action === "edit" && query?.isLoading;

  const imagePublicId = form.watch("imageCldPubId");

  const setProfileImage = (
    file: UploadWidgetValue | null,
    onImageChange: (url: string) => void,
  ) => {
    if (file) {
      onImageChange(file.url);
      form.setValue("imageCldPubId", file.publicId, {
        shouldValidate: true,
        shouldDirty: true,
      });
    } else {
      onImageChange("");
      form.setValue("imageCldPubId", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof userSchema>) => {
    try {
      await onFinish(values);
    } catch (error) {
      console.error(`Error ${action === "create" ? "creating" : "updating"} user:`, error);
    }
  };

  return (
    <div className="my-4 flex items-center">
      <Card className="class-form-card">
        <CardHeader className="relative z-10">
          <CardTitle className="text-2xl pb-0 font-bold text-gradient-orange">
            Fill out form
          </CardTitle>
        </CardHeader>

        <Separator />

        <CardContent className="mt-7">
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Photo</FormLabel>
                    <FormControl>
                      <UploadWidget
                        value={
                          field.value
                            ? { url: field.value, publicId: imagePublicId ?? "" }
                            : null
                        }
                        onChange={(file) =>
                          setProfileImage(file, field.onChange)
                        }
                        label="Click to upload a profile photo"
                        previewAlt="Uploaded profile photo preview"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Name <span className="text-orange-600">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Email <span className="text-orange-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="jane.doe@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Role <span className="text-orange-600">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLE_OPTIONS.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={formLoading || isLoadingRecord}
              >
                {formLoading ? (
                  <div className="flex gap-1">
                    <span>
                      {action === "create" ? "Creating User..." : "Saving Changes..."}
                    </span>
                    <Loader2 className="inline-block ml-2 animate-spin" />
                  </div>
                ) : action === "create" ? (
                  "Create User"
                ) : (
                  "Save Changes"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserForm;
