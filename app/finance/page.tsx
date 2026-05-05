import { UnavailablePage } from "@/components/unavailable-page";

export default function FinancePage() {
  return (
    <UnavailablePage
      title="财务部"
      description="财务价格管理功能暂未开放。未来财务部可以在这里上传价格表、维护价格、统一改价，并对报价进行核价。"
      modules={["价格表设置", "上传价格表", "统一改价", "报价核价"]}
      department="finance"
    />
  );
}
