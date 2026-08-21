import { useEffect, useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import type { UploadWidgetProps, UploadWidgetValue } from "@/types";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "@/constants";

const UploadWidget = ({
  value = null,
  onChange,
  disabled = false,
  label = "Click to upload a banner image",
  previewAlt = "Uploaded banner preview",
}: UploadWidgetProps) => {
  const widgetRef = useRef<CloudinaryWidget | null>(null);
  const onChangeRef = useRef(onChange);
  const [preview, setPreview] = useState<UploadWidgetValue | null>(value);

  useEffect(() => {
    setPreview(value);
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initializeWidget = () => {
      if (!window.cloudinary || widgetRef.current) return false;

      widgetRef.current = window.cloudinary.createUploadWidget(
        {
          cloudName: CLOUDINARY_CLOUD_NAME,
          uploadPreset: CLOUDINARY_UPLOAD_PRESET,
          multiple: false,
          folder: "upload",
          maxFileSize: 5000000,
          clientAllowedFormats: ["png", "jpg", "jpeg", "webp"],
        },
        (error, result) => {
          if (error || result.event !== "success") return;

          const payload: UploadWidgetValue = {
            url: result.info.secure_url,
            publicId: result.info.public_id,
          };

          setPreview(payload);
          onChangeRef.current?.(payload);
        },
      );
      return true;
    };

    if (initializeWidget()) return;

    const intervalId = window.setInterval(() => {
      if (initializeWidget()) {
        window.clearInterval(intervalId);
      }
    }, 500);

    return () => window.clearInterval(intervalId);
  }, []);

  const openWidget = () => {
    if (!disabled) widgetRef.current?.open();
  };

  const removeImage = () => {
    setPreview(null);
    onChangeRef.current?.(null);
  };

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="upload-preview relative">
          <img
            src={preview.url}
            alt={previewAlt}
            className="w-full rounded-md object-cover"
          />
          <button
            type="button"
            onClick={removeImage}
            disabled={disabled}
            className="absolute top-2 right-2 rounded-full bg-background/80 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          className="upload-dropzone"
          role="button"
          tabIndex={0}
          onClick={openWidget}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              openWidget();
            }
          }}
        >
          <UploadCloud className="h-6 w-6" />
          <span>{label}</span>
        </div>
      )}
    </div>
  );
};

export default UploadWidget;