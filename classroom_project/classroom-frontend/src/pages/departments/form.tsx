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
import { useBack } from "@refinedev/core";
import { departmentSchema } from "@/lib/schema.ts";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { Loader2 } from "lucide-react";

type DepartmentFormProps = {
  action: "create" | "edit";
};

const DepartmentForm = ({ action }: DepartmentFormProps) => {
  const back = useBack();
  const form = useForm({
    resolver: zodResolver(departmentSchema),
    refineCoreProps: {
      resource: "departments",
      action,
    },
  });

  const {
    handleSubmit,
    control,
    refineCore: { onFinish, formLoading, query },
  } = form;

  const isLoadingRecord = action === "edit" && query?.isLoading;

  const onSubmit = async (values: z.infer<typeof departmentSchema>) => {
    try {
      await onFinish(values);
    } catch (error) {
      console.error(`Error ${action === "create" ? "creating" : "updating"} department:`, error);
    }
  };

  return (
    <div className="my-4 flex items-center">
      <Card className="class-form-card">
        <CardHeader className="relative z-10">
          <CardTitle className="text-2xl pb-0 font-bold text-gradient-orange">
            {action === "edit" ? "Edit Department" : "Create Department"}
          </CardTitle>
        </CardHeader>

        <Separator />

        <CardContent className="mt-7">
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Department Name{" "}
                        <span className="text-orange-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Computer Science" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Department Code{" "}
                        <span className="text-orange-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="CS" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description about the department"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => back()}
                  disabled={formLoading}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1"
                  disabled={formLoading || isLoadingRecord}
                >
                  {formLoading ? (
                    <div className="flex gap-1">
                      <span>
                        {action === "create"
                          ? "Creating Department..."
                          : "Saving Changes..."}
                      </span>
                      <Loader2 className="inline-block ml-2 animate-spin" />
                    </div>
                  ) : action === "create" ? (
                    "Create Department"
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DepartmentForm;
