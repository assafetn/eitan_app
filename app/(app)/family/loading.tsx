import { SkelGroup, SkelPageShell, SkelTitle } from "@/components/ui/Skeleton";

// Matches FamilyPage: back link + title, then one group with a row per child
// (initial + name/age + chevron).
export default function FamilyLoading() {
  return (
    <SkelPageShell>
      <SkelTitle w="30%" back />
      <SkelGroup count={3} lead={40} rowHeight={68} label={false} />
    </SkelPageShell>
  );
}
