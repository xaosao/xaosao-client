import type { MetaFunction } from "react-router";
import { Header } from "~/components/header";
import { Footer } from "~/components/footer";

export const meta: MetaFunction = () => [
  {
    title: "ເງື່ອນໄຂການໃຫ້ບໍລິການ | Terms & Conditions | Xaosao",
  },
  {
    name: "description",
    content:
      "ເງື່ອນໄຂການໃຊ້ບໍລິການ XaoSao ສຳລັບລູກຄ້າ ແລະ ຜູ້ໃຫ້ບໍລິການ.",
  },
];

const LAST_UPDATED = "30 / 03 / 2026";

/**
 * Unified Terms & Conditions page.
 *
 * Merged from the legacy customer + companion documents. Sections that
 * differ between audiences are tagged with an audience badge so each
 * party can see clauses that apply to them in context, instead of two
 * near-duplicate documents.
 */
export default function TermsConditions() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-24 sm:pt-32 pb-16">
        <article className="max-w-4xl mx-auto px-6 lg:px-8">
          {/* Header */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full mb-4">
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                Legal
              </span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl text-gray-900 leading-tight tracking-tight">
              ເງື່ອນໄຂການໃຫ້ບໍລິການ
            </h1>
            <p className="mt-3 text-gray-400 text-sm">
              Terms &amp; Conditions · ອັບເດດຫຼ້າສຸດ {LAST_UPDATED}
            </p>
          </header>

          <div className="rounded-3xl space-y-10 leading-relaxed text-gray-700">
            {/* Intro */}
            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">ເງື່ອນໄຂ</h2>
              <p>
                ການໃຊ້ຊີວິດໃນປະຈຸບັນ ແມ່ນບໍ່ຄ່ອຍມີເວລາໃນການໄປມາຫາສູ່ກັນຄືສະໄໝກ່ອນ ແລະ ການໃຊ້ໂລກອອນລາຍ
                ກາຍເປັນສ່ວນໜຶ່ງທີ່ໃຊ້ໃນຊີວິດປະຈຳວັນຂອງຄົນເຮົາສ່ວນຫຼາຍໄປແລ້ວ. ດັ່ງນັ້ນ,
                ລະບົບເຊົ່າສາວຈຶ່ງສ້າງຂຶ້ນມາເປັນຕົວກາງໃນການໃຫ້ບໍລິການ, ອຳນວຍຄວາມສະດວກ,
                ຄອບຄຸມການນຳໃຊ້ລະບົບລວມທັງແອັບພລິເຄຊັນມືຖື, ເວັບໄຊ້ ແລະ ການບໍລິການອື່ນໆ
                ທີ່ກ່ຽວຂ້ອງໃຫ້ຖືກຕ້ອງຕາມລະບຽບທີ່ກຳນົດໄວ້. ກະລຸນາໃຫ້ທຸກໆທ່ານອ່ານເງື່ອນໄຂ
                ຂອງລະບົບໃຫ້ເຂົ້າໃຈຢ່າງລະອຽດ ກ່ອນຈະລົງທະບຽນ ຫຼື ໃຊ້ບໍລິການ
                ເພື່ອຄວາມໝັ້ນໃຈສິດທິໃນການນຳໃຊ້ໃນລະບົບຢ່າງຖືກຕ້ອງ.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                Xaosao ເຮັດກ່ຽວກັບຫຍັງ?
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  ແມ່ນລະບົບ ຫຼື ແພລດຟອມ
                  ທີ່ເປັນຕົວກາງອຳນວຍຄວາມສະດວກໃນການຫາເພື່ອນ, ຫາຄູ່,
                  ການຈອງເປັນເພື່ອນ ແລະ ຈອງນວດ ເພື່ອສ້າງລາຍໄດ້ເສີມໃນເວລາຫວ່າງໄດ້ອີກດ້ວຍ.
                  ຊຶ່ງເປັນຕົວເຊື່ອມຕໍ່ລະຫວ່າງຜູ້ບ່າວ ແລະ ຜູ້ສາວທີ່ມີຢູ່ໃນສະຖານທີ່
                  ທີ່ທ່ານກຳລັງຢູ່ໄດ້ຢ່າງງ່າຍຂຶ້ນ ສາມາດຕິດຕໍ່ຫາກັນທັງພາຍໃນ ແລະ
                  ຕ່າງປະເທດໄດ້ຕະຫຼອດເວລາ;
                </li>
                <li>
                  ລະຫວ່າງຜູ້ບ່າວ ແລະ ຜູ້ສາວ ສາມາດຈອງກັນເປັນເພື່ອນ ແລະ ຈອງນວດ
                  ຕາມຮ້ານນວດຕ່າງໆ ພ້ອມທັງແຊັດຫາກັນ ເພື່ອສ້າງຄວາມໝັ້ນໃຈ;
                </li>
                <li>Xaosao ບໍ່ແມ່ນລະບົບການຄ້າປະເວນີ ຫຼື ການຫຼອກລວງແຕ່ຢ່າງໃດ.</li>
              </ul>
            </section>

            {/* I. Registration */}
            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                I. ການຂໍສະໝັກບັນຊີ
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>ຜູ້ສະໝັກ ອາຍຸຕ້ອງມີ 18 ປີ ຂຶ້ນໄປ;</li>
                <li>ສະໝັກຟຣີ ບໍ່ມີຄ່າທຳນຽມ;</li>
                <li>ຂໍ້ມູນ ແລະ ຮູບພາບຕ້ອງ ແມ່ນຂອງຕົນເອງ;</li>
                <li>ຜູ້ສະໝັກ ຕ້ອງສະໝັກໃຈເອງລົງທະບຽນເຂົ້າໃຊ້ລະບົບ;</li>
                <li>ຜູ້ສະໝັກທຸກຄົນ ມີສິດໃຊ້ບໍລິການຕາມຄວາມສະໝັກໃຈ ໃນບໍລິການທີ່ທ່ານເໝາະສົມ;</li>
                <li>
                  ຜູ້ສະໝັກຕ້ອງມີຈັນຍາບັນແຮງ: ໄປຕາມນັດ ຫຼື ບໍ່ສະດວກໄປ ກໍຕ້ອງແຈ້ງລ່ວງໜ້າ;
                </li>
                <li>
                  ຜູ້ສະໝັກ ສາມາດລົງທະບຽນໄດ້ 2 ບັນຊີຄື: ເບື້ອງຂອງຜູ້ໃຫ້ບໍລິການ 01 ບັນຊີ
                  ແລະ ຜູ້ໃຊ້ບໍລິການ 01 ບັນຊີ ເທົ່ານັ້ນ ໂດຍສາມາດໃຊ້ຂໍ້ມູນດຽວກັນໄດ້ທັງ 2 ບັນຊີ;
                </li>
                <li>
                  ຜູ້ສະໝັກຕ້ອງຈ່າຍເງິນຕາມຂັ້ນຕອນ ໃນລະບຽບຂອງລະບົບ xaosao ກຳນົດໄວ້
                  ເພື່ອການຄົ້ນຫາ ແລະ ຈອງອື່ນໆ;
                </li>
                <li>
                  ສະໜອງ ແລະ ອະນຸຍາດ ໃຫ້ທາງລະບົບເຂົ້າເຖິງຂໍ້ມູນສ່ວນຕົວຂອງຕົນເອງ
                  ໂດຍບໍ່ມີການແຈ້ງເຕືອນລ່ວງໜ້າ;
                </li>
                <li>ສະໜອງການປ່ຽນແປງ ນະໂຍບາຍຕ່າງໆ ໂດຍບໍ່ມີການແຈ້ງເຕືອນລ່ວງໜ້າ;</li>
                <li>
                  ລະບົບຈະດຳເນີນການພິຈາລະນາຍືນຍັນ ຫຼື ບໍ່ຍືນຍັນ ຕາມຂໍ້ມູນຂອງຜູ້ສະໝັກ
                  ພາຍໃຕ້ເງື່ອນໄຂທີ່ເໝາະສົມ ແລະ ຖືກຕ້ອງເທົ່ານັ້ນ ແມ່ນຕ້ອງໃຊ້ໄລຍະເວລາພາຍໃນ
                  3 ວັນ ເພື່ອການຍືນຍັນ;
                </li>
                <li>
                  ຖ້າທ່ານໃດ ໄດ້ຮັບການອະນຸມັດຍືນຍັນເປັນສະມາຊິກນຳໃຊ້ລະບົບແລ້ວ
                  ແຕ່ມີການກະທຳຕໍ່ຜູ້ໃຊ້ບໍລິການເຊັ່ນ: ບັງຄັບ, ລ່ວງລ້ຳຮ່າງກາຍ ແລະ
                  ປະພຶດທີ່ບໍ່ສອດຄ່ອງກັບກົດໝາຍ ແລະ ນະໂຍບາຍຂອງລະບົບ xaosao ວາງອອກ
                  ແມ່ນລະບົບຈະຖືກລົບຜູ້ກ່ຽວອອກຈາກລະບົບທັນທີ ພ້ອມທັງດຳເນີນຄະດີຕາມກົດໝາຍ.
                </li>
              </ol>
            </section>

            {/* II. Prohibitions */}
            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">II. ຂໍ້ຫ້າມ</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>ຫ້າມໃຊ້ຮູບພາບໂປ້ຂອງຕົນເອງ ຫຼື ຂອງຜູ້ອື່ນລົງສູ່ລະບົບຢ່າງເດັດຂາດ;</li>
                <li>ຫ້າມໃຊ້ຄຳເວົ້າທີ່ບໍ່ເໝາະສົມ ແລະ ບໍ່ສຸພາບຄອມເມັ້ນໃຫ້ກັນຢ່າງເດັດຂາດ;</li>
                <li>ຫ້າມໃຊ້ຄຳຂາຍ ຫຼື ເຮັດສິ່ງຜິດກົດໝາຍໃນລະບົບຢ່າງເດັດຂາດ;</li>
                <li>
                  ຫ້າມຫຼອກລວງ, ເອົາຮູບພາບ, ຂໍ້ມູນຂອງຄົນອື່ນໄປໃຊ້ໃນທາງທີ່ບໍ່ດີເຊັ່ນ:
                  ວິຈານໃຫ້ເຊື່ອມເສຍ ຫຼື ເຮັດສິ່ງຜິດກົດໝາຍ ໂດຍບໍ່ໄດ້ຮັບອະນຸຍາດຈາກເຈົ້າຂອງຢ່າງເດັດຂາດ.
                </li>
              </ol>
            </section>

            {/* III. Dispute resolution */}
            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                III. ການແກ້ໄຂຂໍ້ຂັດແຍ້ງ
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  ຖ້າຜູ້ໃຊ້ບໍລິການມີຂໍ້ຂັດແຍ້ງ ບໍ່ວ່າໃນເລື່ອງໃດກໍ່ຕາມ
                  ຕ້ອງລວບລວມຂໍ້ມູນຫຼັກຖານຕ່າງໆທີ່ກ່ຽວຂ້ອງເຊັ່ນ: ຮູບພາບ, ສຽງ, ວີດີໂອ
                  ແລະ ຂໍ້ມູນອື່ນໆທີ່ສາມາດເປັນຫຼັກຖານໄດ້, ສົ່ງຄຳຮ້ອງເປັນລາຍລັກອັກສອນ
                  ໃຫ້ເຊົ່າສາວ ພາຍໃນ 15 ວັນລັດຖະການ;
                </li>
                <li>ລະບົບ ຈະເປັນຜູ້ກວດສອບບັນຫາຂໍ້ຂັດແຍ້ງດັ່ງກ່າວວ່າ ຍ້ອນຫຍັງ, ແມ່ນໃຜ ແລະ ອື່ນໆ;</li>
                <li>
                  ທີມຂອງລະບົບ ຈະເຮັດໜ້າທີ່ເປັນຜູ້ໄກ່ເກ່ຍທີ່ເປັນກາງ ລະຫວ່າງຂໍ້ຂັດແຍ້ງດັ່ງກ່າວ
                  ຕາມນະໂຍບາຍ ແລະ ເງື່ອນໄຂຕ່າງໆຂອງລະບົບເຊົ່າສາວກຳນົດໄວ້;
                </li>
                <li>
                  ທັງສອງຝ່າຍຕ້ອງໃຫ້ຄວາມຮ່ວມມືກັນຢ່າງຊັດສັດ ແລະ ໃຫ້ຂໍ້ມູນລາຍລະອຽດທີ່ກ່ຽວຂ້ອງເຊັ່ນ:
                  ຮູບພາບ, ບັນທຶກການສົນທະນາ ຫຼື ຫຼັກຖານອື່ນໆທີ່ກ່ຽວຂ້ອງໃຫ້ທາງລະບົບ;
                </li>
                <li>
                  ຖ້າບໍ່ສາມາດໄກ່ເກ່ຍໃຫ້ບັນລຸຕາມຂໍ້ຕົກລົງ, ພ້ອມໃຫ້ການຮ່ວມມືທັງສອງຝ່າຍ
                  ໃນການແກ້ໄຂຂໍ້ຂັດແຍ້ງ ພາກສ່ວນທີ່ກ່ຽວຂ້ອງ ພາຍໃຕ້ກົດໝາຍຂອງ ສປປລາວ;
                </li>
                <li>
                  ລະບົບມີຄວາມຮັບຜິດຊອບ ພາຍໃນຂອບເຂດການໃຫ້ບໍລິການທີ່ໄດ້ກຳນົດໃນລະບົບເທົ່ານັ້ນ.
                  ຖ້າຜູ້ໃດລະເມີດ ໃຊ້ບໍລິການນອກເໜືອຈາກທີ່ລະບົບໄດ້ກຳນົດ
                  ຫາກເກີດມີບັນຫາຕາມມາ ແມ່ນລະບົບຈະບໍ່ໄດ້ຮັບຜິດຊອບທາງດ້ານຄວາມເສຍຫາຍ
                  ແລະ ທາງດ້ານກົດໝາຍແຕ່ຢ່າງໃດ.
                </li>
              </ol>
            </section>

            {/* IV. Account closure */}
            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">IV. ການປິດບັນຊີ</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  ຜູ້ກ່ຽວສາມາດລົບບັນຊີຂອງຕົນ ອອກຈາກລະບົບໄດ້ດ້ວຍຕົນເອງ
                  ລວມທັງປະຫວັດການໃຊ້ງານ, ຍອດເງິນໃນບັນຊີ ແລະ ລາຍການບັນທຶກຕ່າງໆທັງໝົດ
                  ຈະຖືກລົບອອກຈາກລະບົບ. ຖ້າພາຍໃນໄລຍະເວລາ 30 ວັນ ເຈົ້າຂອງບັນຊີບໍ່ຮ້ອງຂໍກູ້ຄືນບັນຊີ
                  ເປັນລາຍລັກອັກສອນ ແມ່ນລະບົບຈະລົບອອກຢ່າງຖາວອນ;
                </li>
                <li>
                  ການລົບບັນຊີອອກຖາວອນ ແມ່ນລະບົບຈະແຈ້ງເປັນຂໍ້ຄວາມອີເມວ ຫຼື ເບີໂທລະສັບໃຫ້ລ່ວງໜ້າ
                  ກ່ອນການລົບອອກພາຍໃນ 7 ວັນ;
                </li>
                <li>
                  ບັນຊີໃດທີ່ບໍ່ມີການເຄື່ອນໄຫວເປັນໄລຍະເວລາ 3 ເດືອນ ລະບົບຈະລົບອອກໂດຍອັດຕະໂນມັດ,
                  ແຕ່ລະບົບຈະແຈ້ງທາງອີເມວ ຫຼື ເບີໂທລະສັບລ່ວງໜ້າ 15 ວັນ;
                </li>
                <li>
                  ອາດຈະລະງັບ ຫຼື ປິດບັນຊີໃນກໍລະນີມີການສໍ້ໂກງ, ສ້າງບັນຊີເກີນ, ການສວຍໃຊ້ລະບົບ
                  ໃນທາງທີ່ຜິດກົດໝາຍ ຫຼື ການລະເມີດນະໂຍບາຍຂອງລະບົບ;
                </li>
                <li className="bg-rose-50 -mx-2 px-2 py-2 rounded-lg">
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full mr-2 align-middle">
                    ລູກຄ້າ · Customer
                  </span>
                  ຍອດເງິນທີ່ຄົງຄ້າງໃນບັນຊີທີ່ຖືກລົບອອກດ້ວຍຕົນເອງ ຫຼື ລະເມີດນະໂຍບາຍຂອງລະບົບ
                  ແມ່ນບໍ່ສາມາດຖອນອອກໄດ້ຄື: (1) ຖ້າບັນຊີຖືກລົບດ້ວຍຕົນເອງ
                  ລະບົບຈະບໍ່ສົ່ງຍອດເງິນທີ່ຍັງເຫຼືອຄືນໃຫ້ແຕ່ຢ່າງໃດ; (2)
                  ກໍລະນີລະບົບລົບບັນຊີຂອງຜູ້ກ່ຽວ ຍ້ອນການບໍ່ປະຕິບັດຕາມເງື່ອນໄຂ ແລະ ຂໍ້ກຳນົດຂອງລະບົບ
                  ຫຼື ເຮັດຜິດກົດໝາຍ ແມ່ນລະບົບຈະບໍ່ຈ່າຍເງິນທີ່ຍັງຄ້າງໃນບັນຊີຄືນໃຫ້
                  ພ້ອມທັງບວກຄ່າເສຍຫາຍທີ່ຜູ້ກ່ຽວທຳເພີ່ມຕື່ມອີກ.
                </li>
                <li className="bg-rose-50 -mx-2 px-2 py-2 rounded-lg">
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full mr-2 align-middle">
                    ຜູ້ໃຫ້ບໍລິການ · Companion
                  </span>
                  ຖ້າທ່ານໃດ ໄດ້ຮັບການອະນຸມັດຍືນຍັນເປັນສະມາຊິກໃນລະບົບແລ້ວ
                  ແຕ່ບໍ່ເປີດສະໝັກໃຫ້ບໍລິການ ຢ່າງໜ້ອຍ 1 ຢ່າງ
                  ແມ່ນລະບົບຈະປິດໜ້າຂອງຜູ້ກ່ຽວໃນລະບົບ ພາຍໃນໄລຍະເວລາ 7 ວັນ
                  ນັບຕັ້ງແຕ່ມື້ໄດ້ຮັບການຍືນຍັນ. ຫຼັງຈາກນັ້ນ 30 ວັນ
                  ຖ້າຜູ້ກ່ຽວຢັ້ນບໍ່ຕິດຕໍ່ຫາລະບົບ ເພື່ອເປີດໃຊ້ຄືນ
                  ແມ່ນຈະລົບບັນຊີຂອງຜູ້ກ່ຽວອອກຈາກລະບົບຢ່າງຖາວອນ.
                </li>
              </ol>
            </section>

            {/* V. Top-up — customer only */}
            <section className="border-l-4 border-rose-500 pl-5">
              <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full mb-2">
                ລູກຄ້າ · Customer
              </div>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">V. ການຄືນເງິນ</h2>
              <p className="mb-3">ລະບົບສາມາດຄືນເງິນໃຫ້ໄດ້ຕາມເງື່ອນໄຂດັ່ງລຸ່ມນີ້:</p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>ສາມາດຖອນເງິນຄືນຂັ້ນຕ່ຳ 100,000 ກີບ ຂຶ້ນໄປ;</li>
                <li>ຄ່າທຳນຽມໃນການດຳເນີນການໂອນເງິນຄືນ 10% ຂອງຍອດເງິນທີ່ໂອນຄືນ;</li>
                <li>ໄລຍະເວລາດຳເນີນການໂອນເງິນຄືນ ພາຍໃນ 7 ວັນ;</li>
                <li>ໃຫ້ຕິດຕໍ່ ແລະ ພົວພັນການຖອນເງິນຄືນ ທາງອັດມິນໂດຍກົງ.</li>
              </ol>
            </section>

            {/* VI. Customer benefits */}
            <section className="border-l-4 border-rose-500 pl-5">
              <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full mb-2">
                ລູກຄ້າ · Customer
              </div>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">VI. ຜົນປະໂຫຍດທີ່ຈະໄດ້ຮັບ</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>ຕອບສະໜອງຕາມຄວາມຕ້ອງການໄດ້ຢ່າງວ່ອງໄວ;</li>
                <li>ບໍ່ເສຍເວລາ;</li>
                <li>ມີຕົວເລືອກຫຼາຍ ເພື່ອຈອງເປັນເພື່ອນສ້າງສັນ;</li>
                <li>ເປັນການສ້າງຄວາມຮູ້ຈັກກັນ ແລະ ເພີ່ມຄວາມຮູ້ – ຄວາມເຂົ້າໃຈກັບສັງຄົມໃຫ້ຫຼາຍຂຶ້ນ.</li>
              </ol>
            </section>

            {/* V. Companion benefits (renumbered to match model doc) */}
            <section className="border-l-4 border-rose-500 pl-5">
              <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full mb-2">
                ຜູ້ໃຫ້ບໍລິການ · Companion
              </div>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">VI. ຜົນປະໂຫຍດທີ່ຈະໄດ້ຮັບ</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>ໄດ້ຮັບເງິນຈາກການໃຫ້ບໍລິການ ຕາມເວລານັດໝາຍ;</li>
                <li>ຄ່າຄອມເມຊັນໃນແຕ່ລະລະດັບ ທີ່ທາງລະບົບກຳນົດໄວ້;</li>
                <li>ເງິນໂປຣໂມດຕ່າງໆ ຈາກລະບົບ;</li>
                <li>ເປັນການສ້າງເພື່ອນ ແລະ ເພີ່ມຄວາມຮູ້ – ຄວາມເຂົ້າໃຈກັບສັງຄົມໃຫ້ຫຼາຍຂຶ້ນ;</li>
              </ol>
              <p className="mt-3 text-sm text-gray-500 italic">
                ໝາຍເຫດ: ທ່ານສາມາດຖອນເງິນໄດ້ຕະຫຼອດເວລາ ໂດຍບໍ່ມີຂັ້ນຕ່ຳ
                ແລະ ທ່ານສາມາດກວດສອບບັນຊີເງິນລາຍຮັບຂອງທ່ານໄດ້ສະເໝີ.
              </p>
            </section>

            {/* Footer */}
            <section className="text-center pt-6 border-t border-gray-100 text-sm text-gray-500">
              <p>
                ສຳລັບລາຍລະອຽດກ່ຽວກັບການເກັບ ການໃຊ້ ແລະ ການປົກປ້ອງຂໍ້ມູນສ່ວນບຸກຄົນຂອງທ່ານ, ກະລຸນາອ່ານ{" "}
                <a
                  href="/privacy-policy"
                  className="text-rose-500 hover:text-rose-600 font-semibold"
                >
                  ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ
                </a>
                .
              </p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
