import { Cloudinary } from "@cloudinary/url-gen";
import { CLOUDINARY_CLOUD_NAME } from "@/constants";
import { fill } from "@cloudinary/url-gen/actions/resize";
import { dpr, format, quality } from "@cloudinary/url-gen/actions/delivery";
import { text } from "@cloudinary/url-gen/qualifiers/source";
import { source } from "@cloudinary/url-gen/actions/overlay";
import { TextStyle } from "@cloudinary/url-gen/qualifiers/textStyle";
import { Position } from "@cloudinary/url-gen/qualifiers/position";
import { compass } from "@cloudinary/url-gen/qualifiers/gravity";

const cld = new Cloudinary({ cloud: { cloudName: CLOUDINARY_CLOUD_NAME } });

export const bannerPhoto = (imageCldPubId: string, name: string) => {
  return cld
    .image(imageCldPubId)
    .resize(fill(1500, 300))
    .delivery(format("auto"))
    .delivery(quality("auto"))
    .delivery(dpr("auto"))
    .overlay(
      source(
        text(name, new TextStyle("roboto", 100).fontWeight("bold")).textColor(
          "white",
        ),
      ).position(new Position().gravity(compass("west")).offsetX(0.02)),
    );
};

// Built at render time from the stored public_id, never from a stored URL -
// so the crop/format/quality transformation can change later without a
// migration. Face-gravity cropping matters specifically for portraits:
// centre-cropping cuts off heads. `size` is the delivered pixel dimension
// (square); requesting it larger than the display size keeps it sharp on
// high-DPR screens via dpr_auto.
export const buildCloudinaryAvatarUrl = (publicId: string, size = 80): string =>
  `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,c_fill,g_face,w_${size},h_${size},dpr_auto/${publicId}`;

// Same circular-thumbnail delivery as the avatar helper above, minus
// g_face - a class banner isn't a portrait, so face-detection cropping has
// nothing to find and would just crop arbitrarily.
export const buildClassBannerThumbUrl = (publicId: string, size = 80): string =>
  `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,c_fill,w_${size},h_${size},dpr_auto/${publicId}`;

// A real uploaded photo (imageCldPubId, via the upload widget) always wins
// over a seeded placeholder (image - a DiceBear URL for fixture people, see
// lib/seedWorkspace.ts on the backend) - once someone uploads their own
// picture, the generated placeholder should stop showing. Neither present
// means AvatarFallback (initials) renders instead; this returns undefined
// rather than an empty string so `<AvatarImage src={undefined}>` skips
// rendering entirely instead of trying to load a blank URL.
export const buildAvatarSrc = (
  imageCldPubId?: string | null,
  image?: string | null,
): string | undefined => {
  if (imageCldPubId) return buildCloudinaryAvatarUrl(imageCldPubId);
  if (image) return image;
  return undefined;
};
