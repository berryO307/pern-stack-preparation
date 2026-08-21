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
import { useList } from "@refinedev/core";
import { subjectSchema } from "@/lib/schema.ts";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { Loader2 } from "lucide-react";
import type { Department } from "@/types";

type SubjectFormProps = {
  action: "create" | "edit";
};

const SubjectForm = ({ action }: SubjectFormProps) => {
  const form = useForm({
    resolver: zodResolver(subjectSchema),
    refineCoreProps: {
      resource: "subjects",
      action,
    },
  });

  const {
    handleSubmit,
    control,
    refineCore: { onFinish, formLoading, query },
  } = form;

  const isLoadingRecord = action === "edit" && query?.isLoading;

  const { query: departmentsQuery } = useList<Department>({
    resource: "departments",
    pagination: { pageSize: 100 },
  });
  const departments = departmentsQuery?.data?.data ?? [];
  const departmentsLoading = departmentsQuery.isLoading;

  const onSubmit = async (values: z.infer<typeof subjectSchema>) => {
    try {
      await onFinish(values);
    } catch (error) {
      console.error(`Error ${action === "create" ? "creating" : "updating"} subject:`, error);
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
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Subject Name <span className="text-orange-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Linear Algebra" {...field} />
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
                        Subject Code <span className="text-orange-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="MATH220" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Department <span className="text-orange-600">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value?.toString()}
                      disabled={departmentsLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id.toString()}>
                            {department.name} ({department.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description about the subject"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      {action === "create" ? "Creating Subject..." : "Saving Changes..."}
                    </span>
                    <Loader2 className="inline-block ml-2 animate-spin" />
                  </div>
                ) : action === "create" ? (
                  "Create Subject"
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

export default SubjectForm;
