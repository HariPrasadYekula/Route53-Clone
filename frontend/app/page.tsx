import { redirect } from "next/navigation";

export default function Index() {
  redirect("/route53/v2/home");
}
