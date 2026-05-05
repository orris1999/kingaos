import { UnavailablePage } from "@/components/unavailable-page";

export default function ExportPricingPage() {
  return (
    <UnavailablePage
      title="出口部 / 查询价格"
      description="查询价格功能未来由财务部统一维护价格表后开放。出口部只能查询财务确认后的价格，不能修改价格。"
      modules={["查询财务批准价格"]}
    />
  );
}
