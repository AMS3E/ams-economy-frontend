import RealEstateFinanceSection from "@/components/home/sections/RealEstateFinanceSection";
import { categoryRefs } from "@/lib/articles";

/** Homepage-style real-estate and business card rows beside finance stories. */
export default async function RealEstateBusinessFinanceSection() {
  const [realestate, business, finance] = await Promise.all([
    categoryRefs("news-realestate", 3),
    categoryRefs("news-business", 3),
    categoryRefs("news-finance", 5),
  ]);

  return <RealEstateFinanceSection realestate={realestate} business={business} finance={finance} />;
}
