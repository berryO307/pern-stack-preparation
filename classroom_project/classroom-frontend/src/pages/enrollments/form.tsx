import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import { useGetIdentity, useInvalidate, useList } from "@refinedev/core";
import { INVITE_CODE_REGEX, enrollmentSchema } from "@/lib/schema.ts";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import { AlertCircle, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Class } from "@/types";

type Identity = { email?: string };

const EnrollmentForm = () => {
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const invalidate = useInvalidate();

  const { data: identity, isLoading: identityLoading } = useGetIdentity<Identity>();

  const { query: classesQuery } = useList<Class>({
    resource: "classes",
    pagination: { pageSize: 100 },
  });

  const classes = classesQuery?.data?.data ?? [];
  const classesLoading = classesQuery.isLoading;

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
    watch,
    setValue,
    setError,
    getValues,
    formState: { dirtyFields, isSubmitting },
    refineCore: { onFinish, formLoading },
  } = form;

  // Prefill once from the session, on the assumption the visitor is
  // enrolling themselves - but never overwrite something they've already
  // started typing, and never do it more than once (a late-resolving
  // session shouldn't wipe input that arrived first).
  useEffect(() => {
    if (identity?.email && !dirtyFields.email) {
      setValue("email", identity.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity?.email]);

  const inviteCodeValue = watch("inviteCode");
  const classIdValue = watch("classId");

  // Reverse direction only: a complete, well-formed code auto-selects its
  // class. The other direction never happens - selecting a class must not
  // reveal or fill in its code, since typing the code is the proof of
  // access this form exists to check.
  useEffect(() => {
    if (!inviteCodeValue || !INVITE_CODE_REGEX.test(inviteCodeValue)) return;
    const match = classes.find((klass) => klass.inviteCode === inviteCodeValue);
    if (match && getValues("classId") !== match.id) {
      setValue("classId", match.id, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCodeValue, classes]);

  const selectedClass = useMemo(
    () => classes.find((klass) => klass.id === classIdValue),
    [classes, classIdValue],
  );

  const onSubmit = async (values: z.infer<typeof enrollmentSchema>) => {
    try {
      await onFinish(values);
      await invalidate({ resource: "classes", invalidates: ["list", "many"] });
    } catch (error) {
      // Field-scoped errors (422 with a per-field body) are already applied
      // to the right inputs by the react-hook-form binding's own
      // onMutationError handler, from the *thrown error's* own `errors`
      // property - not from formState, which is a stale closure at this
      // point (the setError() calls that populate it haven't necessarily
      // committed yet). Checking the error object directly, not formState,
      // is what actually avoids showing a redundant root alert alongside a
      // field error. Values stay exactly as the visitor left them either way.
      const fieldErrors =
        error && typeof error === "object" && "errors" in error
          ? (error as { errors?: Record<string, unknown> }).errors
          : undefined;

      if (!fieldErrors || Object.keys(fieldErrors).length === 0) {
        const message = error instanceof Error ? error.message : "Failed to enroll. Please try again.";
        setError("root", { type: "manual", message });
      }
    }
  };

  return (
    <div className="my-4 flex items-center">
      <Card className="w-full max-w-xl">
        <CardContent className="mt-7">
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {form.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={control}
                name="classId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                      Class <span className="text-orange-600">*</span>
                    </FormLabel>
                    <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={comboboxOpen}
                            disabled={classesLoading || classes.length === 0}
                            className={cn(
                              "w-full justify-between font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {classesLoading
                              ? "Loading classes..."
                              : classes.length === 0
                                ? "No classes available yet"
                                : selectedClass
                                  ? selectedClass.name
                                  : "Select a class"}
                            <ChevronsUpDown className="opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                        <Command>
                          <CommandInput placeholder="Search classes..." />
                          <CommandList>
                            <CommandEmpty>
                              No classes match. Browse{" "}
                              <a href="/classes" className="underline underline-offset-2">
                                all classes
                              </a>
                              .
                            </CommandEmpty>
                            <CommandGroup>
                              {classes.map((klass) => {
                                const remaining = klass.capacity - (klass.enrolledCount ?? 0);
                                const isFull = remaining <= 0;
                                const secondary = [klass.subject?.name, klass.department?.name]
                                  .filter(Boolean)
                                  .join(" · ");

                                return (
                                  <CommandItem
                                    key={klass.id}
                                    value={`${klass.name} ${secondary}`}
                                    disabled={isFull}
                                    onSelect={() => {
                                      if (isFull) return;
                                      setValue("classId", klass.id, { shouldValidate: true });
                                      setComboboxOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-1 h-4 w-4",
                                        field.value === klass.id ? "opacity-100" : "opacity-0",
                                      )}
                                    />
                                    <div className="flex min-w-0 flex-col">
                                      <span className="truncate">{klass.name}</span>
                                      {secondary && (
                                        <span className="truncate text-xs text-muted-foreground">
                                          {secondary}
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={cn(
                                        "ml-auto shrink-0 text-xs",
                                        isFull ? "font-medium text-destructive" : "text-muted-foreground",
                                      )}
                                    >
                                      {isFull ? "Full" : `${remaining} of ${klass.capacity} seats left`}
                                    </span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Email address <span className="text-orange-600">*</span>
                    </FormLabel>
                    {identityLoading ? (
                      <Skeleton className="h-9 w-full" />
                    ) : (
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                    )}
                    <FormDescription>
                      Using your account email — change it to enroll a different address.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="inviteCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Invite code <span className="text-orange-600">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={6}
                        autoComplete="off"
                        autoCapitalize="characters"
                        className="font-mono uppercase tracking-widest"
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData("text").replace(/\s+/g, "").toUpperCase();
                          field.onChange(pasted.slice(0, 6));
                        }}
                      />
                    </FormControl>
                    <FormDescription>3 letters and 3 numbers, e.g. CSE101.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="lg" asChild>
                  <a href="/enrollments">Cancel</a>
                </Button>
                <Button type="submit" size="lg" disabled={formLoading || isSubmitting}>
                  {formLoading || isSubmitting ? (
                    <span className="flex items-center gap-2">
                      Enrolling...
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </span>
                  ) : (
                    "Enroll"
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

export default EnrollmentForm;
