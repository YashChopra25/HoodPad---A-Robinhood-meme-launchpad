/**
 * The image written into a coin's contract at launch.
 *
 * The create form's photo picker is fully wired up — upload, compression,
 * preview and links all work — but for now every launch stores the hardcoded
 * value below instead of what the creator picked. To change it:
 *
 *   - swap HARDCODED_LAUNCH_IMAGE for another data URI, https:// or ipfs:// link
 *   - or set USE_HARDCODED_LAUNCH_IMAGE to false to store the creator's photo
 *
 * An owner who has not renounced can still replace the image afterwards from
 * Creator tools on the coin page.
 */

/** When true, launches ignore the picked photo and store HARDCODED_LAUNCH_IMAGE. */
export const USE_HARDCODED_LAUNCH_IMAGE = true;

/** 64×64 PNG, ~330 bytes, so it stays cheap to store on-chain. */
const HARDCODED_LAUNCH_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAsElEQVR42u3aMRKAIAxE0e3tLL3/cbyTtlYOApKw/Jkc4L9OE7Qd+9QjAAAAAAAAAMBzzksvkxfw3v2fROPT+zIUld6LofD6RoPC0xsZylNfZ1Cq+grDSoAx9V8NSlj/ybAGYHx9uWEBQFR9oQFAckBsfYkBAAAAAAAAcAbwLQSAHxoLAFuJBIDpF1vsRnMApl+vOxw4HE5MJkc+hzOryaHb5KkBr1UAAAAAAACAirkBRZXcFYct4dUAAAAASUVORK5CYII=";

/** The image value to pass to the contract for a launch. */
export function launchImageFor(picked: string): string {
  return USE_HARDCODED_LAUNCH_IMAGE ? HARDCODED_LAUNCH_IMAGE : picked.trim();
}
