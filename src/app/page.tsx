import { FormAssistant } from "@/components/assistant/FormAssistant";
import { ConfiguratorSection } from "@/components/configurator/ConfiguratorSection";
import { Header } from "@/components/layout/Header";
import { ConnectivitySection } from "@/components/sections/ConnectivitySection";
import { FinalSection } from "@/components/sections/FinalSection";
import { SpecsSection } from "@/components/sections/SpecsSection";
import { StoryExperience } from "@/components/sections/StoryExperience";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <StoryExperience />
        <ConnectivitySection />
        <ConfiguratorSection />
        <SpecsSection />
        <FinalSection />
      </main>
      <FormAssistant />
    </>
  );
}
