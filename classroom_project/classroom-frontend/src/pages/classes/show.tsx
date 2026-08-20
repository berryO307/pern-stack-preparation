import React from "react";
import { ClassDetails } from "@/types";
import { useShow } from "@refinedev/core";
import { isError } from "node:util";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Button } from "@/components/ui/button.tsx";
import { AdvancedImage } from "@cloudinary/react";
import { bannerPhoto } from "@/lib/cloudinary.ts";

const Show = () => {
  const { query } = useShow<ClassDetails>({ resource: "classes" });

  const classDetails = query.data?.data;
  const { isLoading, isError } = query;

  if (isLoading || isError || !classDetails) {
    return (
      <ShowView className="class-view class-show">
        <ShowViewHeader resource="classes" title="class details" />

        <p className="state-message">
          {isLoading
            ? "Loading class details..."
            : isError
              ? "failed to load class details..."
              : "class details not found"}
        </p>
      </ShowView>
    );
  }

  const teacherName = classDetails.teacherName?.name ?? "Unknow";
  const teachersInitials = teacherName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(" ");

  const placeholderUrl = `https://placehold.co/600*400?text=${encodeURIComponent(teachersInitials || "NA")}`;

  const {
    name,
    description,
    status,
    capacity,
    bannerUrl,
    bannerCldPubId,
    subject,
    teacher,
    department,
  } = classDetails;

  return (
    <ShowView className="class-view class-show">
      <ShowViewHeader resource="classes" title="class details" />
      <div className="banner">
        {bannerUrl ? (
          <AdvancedImage
            alt="class Banner"
            cldImg={bannerPhoto(bannerCldPubId ?? "", name)}
          />
        ) : (
          <div className="placeholder" />
        )}
      </div>
      ;
      <Card className="details-card">
        <div className="details-header">
          <div>
            <h1>{name}</h1>
            <p>{description}</p>
          </div>
        </div>

        <div>
          <Badge variant="outline">{capacity} spots</Badge>
          <Badge
            variant={status === "active" ? "default" : "secondary"}
            data-status={status}
          >
            {status.toUpperCase()}
          </Badge>
        </div>
        <div className="details-grid">
          <div className="instructor">
            <p> Instructor</p>
            <div>
              <img src={teacher?.image ?? placeholderUrl} alt={teacherName} />
              <div>
                <p> {teacherName}</p>
                <p>{teacher?.email}</p>
              </div>
            </div>
          </div>
          <div>
            <p>{department?.name}</p>
            <p>{department?.description}</p>
          </div>
        </div>
        <Separator />

        <div className="subject">
          <p>Subject</p>
          <div>
            <Badge variant="outline">Code: {subject?.code}</Badge>
            <p>{subject?.name}</p>
            <p>{subject?.description}</p>
          </div>
        </div>

        <Separator />

        <div className="join">
          <h2> Join Class</h2>

          <ol>
            <li> Ask your teacher for the invite code </li>
            <li> Click on "Join Class" button </li>
            <li> Paste the code and click "join" </li>
          </ol>
        </div>
        <Button size="lg" className="w-full">
          Join Class
        </Button>
      </Card>
    </ShowView>
  );
};

export default Show;
