import { UnavailablePage } from "@/components/unavailable-page";

export default function DomesticPage() {
  return (
    <UnavailablePage
      title="国内部"
      description="国内部功能暂未开放。未来将建设国内客户档案和国内业务管理功能。"
      modules={["国内客户档案", "国内业务管理"]}
      department="domestic"
    />
  );
}
