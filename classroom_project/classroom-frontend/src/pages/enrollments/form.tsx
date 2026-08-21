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
import { enrollmentSchema } from "@/lib/schema.ts";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Loader2 } from "lucide-react";
import type { Class, User } from "@/types";

const EnrollmentForm = () => {
  const form = useForm({
    resolver: zodResolver(enrollmentSchema),
    refineCoreProps: {
      resource: "enrollments",
      action: "create",
    },
  });

  const {
    handleSubmit,
    control,
    refineCore: { onFinish, formLoading },
  } = form;

  const { query: classesQuery } = useList<Class>({
    resource: "classes",
    pagination: { pageSize: 100 },
  });
  const { query: studentsQuery } = useList<User>({
    resource: "users",
    filters: [{ field: "role", operator: "eq", value: "student" }],
    pagination: { pageSize: 100 },
  });

  const classes = classesQuery?.data?.data ?? [];
  const students = studentsQuery?.data?.data ?? [];
  const classesLoading = classesQuery.isLoading;
  const studentsLoading = studentsQuery.isLoading;

  const onSubmit = async (values: z.infer<typeof enrollmentSchema>) => {
    try {
      await onFinish(values);
    } catch (error) {
      console.error("Error creating enrollment:", error);
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
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Student <span className="text-orange-600">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={studentsLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a student" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id.toString()}>
                            {student.name} ({student.email})
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
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Class <span className="text-orange-600">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value?.toString()}
                      disabled={classesLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a class" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {classes.map((klass) => (
                          <SelectItem key={klass.id} value={klass.id.toString()}>
                            {klass.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <span>Enrolling...</span>
                    <Loader2 className="inline-block ml-2 animate-spin" />
                  </div>
                ) : (
                  "Enroll Student"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnrollmentForm;
