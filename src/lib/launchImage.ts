/**
 * The image written into a coin's contract at launch.
 *
 * Launches store whatever the creator picked in the create form. Set
 * USE_HARDCODED_LAUNCH_IMAGE to true to make every launch store
 * HARDCODED_LAUNCH_IMAGE instead.
 *
 * An owner who has not renounced can still replace the image afterwards from
 * Creator tools on the coin page.
 */

/** When true, launches ignore the picked photo and store HARDCODED_LAUNCH_IMAGE. */
export const USE_HARDCODED_LAUNCH_IMAGE = false;

/** 64×64 PNG, ~330 bytes, so it stays cheap to store on-chain. */
const HARDCODED_LAUNCH_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAsElEQVR42u3aMRKAIAxE0e3tLL3/cbyTtlYOApKw/Jkc4L9OE7Qd+9QjAAAAAAAAAMBzzksvkxfw3v2fROPT+zIUld6LofD6RoPC0xsZylNfZ1Cq+grDSoAx9V8NSlj/ybAGYHx9uWEBQFR9oQFAckBsfYkBAAAAAAAAcAbwLQSAHxoLAFuJBIDpF1vsRnMApl+vOxw4HE5MJkc+hzOryaHb5KkBr1UAAAAAAACAirkBRZXcFYct4dUAAAAASUVORK5CYII=";

/** The image value to pass to the contract for a launch. */
export function launchImageFor(picked: string): string {
  return USE_HARDCODED_LAUNCH_IMAGE ? HARDCODED_LAUNCH_IMAGE : picked.trim();
}
