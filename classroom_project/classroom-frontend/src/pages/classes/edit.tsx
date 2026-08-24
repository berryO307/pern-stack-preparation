import { EditView, EditViewHeader } from "@/components/refine-ui/views/edit-view.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useList } from "@refinedev/core";
import { Separator } from "@/components/ui/separator.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import { classSchema } from "@/lib/schema.ts";
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
import UploadWidget from "@/components/upload-widget.tsx";
import type { Subject, UploadWidgetValue, User } from "@/types";
import { Skeleton } from "@/components/ui/skeleton.tsx";

const Edit = () => {
  const form = useForm({
    resolver: zodResolver(classSchema),
    refineCoreProps: {
      resource: "classes",
      action: "edit",
    },
  });

  const {
    handleSubmit,
    formState: { errors },
    control,
    refineCore: { onFinish, formLoading, query },
  } = form;

  const isLoadingRecord = query?.isLoading;
  const bannerPublicId = form.watch("bannerCldPubId");

  const onSubmit = async (values: z.infer<typeof classSchema>) => {
    try {
      await onFinish(values);
    } catch (error) {
      console.error("Error updating class:", error);
    }
  };

  const { query: subjectsQuery } = useList<Subject>({
    resource: "subjects",
    pagination: { pageSize: 100 },
  });

  const { query: teachersQuery } = useList<User>({
    resource: "users",
    filters: [{ field: "role", operator: "eq", value: "teacher" }],
    pagination: { pageSize: 100 },
  });

  const subjects = subjectsQuery?.data?.data || [];
  const teachers = teachersQuery?.data?.data || [];

  const subjectsLoading = subjectsQuery.isLoading;
  const teacherLoading = teachersQuery.isLoading;

  const setBannerImage = (
    file: UploadWidgetValue | null,
    onBannerUrlChange: (url: string) => void,
  ) => {
    if (file) {
      onBannerUrlChange(file.url);
      form.setValue("bannerCldPubId", file.publicId, {
        shouldValidate: true,
        shouldDirty: true,
      });
    } else {
      onBannerUrlChange("");
      form.setValue("bannerCldPubId", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  return (
    <EditView className="class-view">
      <EditViewHeader resource="classes" title="Edit Class" />

      <div className="my-4 flex items-center">
        <Card className="class-form-card">
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl pb-0 font-bold text-gradient-orange">
              Fill out form
            </CardTitle>
          </CardHeader>

          <Separator />

          <CardContent className="mt-7">
            {isLoadingRecord ? (
              <div className="space-y-5">
                <Skeleton className="h-40 w-full rounded-md" />
                <Skeleton className="h-10 w-full" />
                <div className="grid sm:grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={control}
                    name="bannerUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Banner Image<span className="text-orange-600">*</span>
                        </FormLabel>
                        <FormControl>
                          <UploadWidget
                            value={
                              field.value
                                ? {
                                    url: field.value,
                                    publicId: bannerPublicId ?? "",
                                  }
                                : null
                            }
                            onChange={(file) =>
                              setBannerImage(file, field.onChange)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                        {errors.bannerCldPubId && !errors.bannerUrl && (
                          <p className="text-destructive text-sm">
                            {errors.bannerCldPubId.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Class Name <span className="text-orange-600">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Introduction to Biology - Section A"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={control}
                      name="subjectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Subject <span className="text-orange-600">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={(value) =>
                              field.onChange(Number(value))
                            }
                            value={field.value?.toString()}
                            disabled={subjectsLoading}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a subject" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {subjects.map((subject) => (
                                <SelectItem
                                  key={subject.id}
                                  value={subject.id.toString()}
                                >
                                  {subject.name} ({subject.code})
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
                      name="teacherId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Teacher <span className="text-orange-600">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a teacher" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {teachers.map((teacher) => (
                                <SelectItem
                                  key={teacher.id}
                                  value={teacher.id.toString()}
                                >
                                  {teacher.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="30"
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value ? Number(value) : undefined);
                              }}
                              value={(field.value as number | undefined) ?? ""}
                              name={field.name}
                              ref={field.ref}
                              onBlur={field.onBlur}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Status <span className="text-orange-600">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={teacherLoading}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
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
                            placeholder="Brief description about the class"
                            {...field}
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
                    disabled={formLoading}
                  >
                    {formLoading ? (
                      <div className="flex gap-1">
                        <span>Saving Changes...</span>
                        <Loader2 className="inline-block ml-2 animate-spin" />
                      </div>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </EditView>
  );
};

export default Edit;
