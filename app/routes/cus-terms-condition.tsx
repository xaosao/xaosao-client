import type { MetaFunction } from "react-router";
import { Header } from "~/components/header";
import { Footer } from "~/components/footer";

export const meta: MetaFunction = () => {
   return [{ title: "ເງື່ອນໄຂ ແລະ ນະໂຍບາຍ - ຜູ້ໃຊ້ບໍລິການ | Xaosao" }];
};

const pages = Array.from({ length: 14 }, (_, i) =>
   `/terms-conditions/cus-page-${String(i + 1).padStart(2, "0")}.png`
);

export default function CustomerTermsCondition() {
   return (
      <div className="min-h-screen flex flex-col bg-white">
         <Header />
         <main className="flex-1 pt-16 bg-white">
            <div className="max-w-4xl mx-auto py-8">
               {pages.map((src, i) => (
                  <img
                     key={i}
                     src={src}
                     alt={`Page ${i + 1}`}
                     className="w-full block border"
                     style={{ marginBottom: i < pages.length - 1 ? "2px" : 0 }}
                     loading={i === 0 ? "eager" : "lazy"}
                  />
               ))}
            </div>
         </main>
         <Footer />
      </div>
   );
}
