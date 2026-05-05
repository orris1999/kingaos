import { UnavailablePage } from "@/components/unavailable-page";

export default function TechnicalPage() {
  return (
    <UnavailablePage
      title="技术部"
      description="技术部功能暂未开放。未来将建设产品资料、产品参数、技术审核和内部支持功能。"
      modules={["产品资料", "产品参数", "技术审核", "内部支持"]}
      department="technical"
    />
  );
}
