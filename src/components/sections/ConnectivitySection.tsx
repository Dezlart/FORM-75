"use client";

import { Bluetooth, Cable, Radio } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";

export function ConnectivitySection() {
  const { dictionary: t } = useLocale();
  return (
    <section id="connectivity" className="content-section connectivity-section">
      <div className="section-heading">
        <p className="eyebrow">{t.wireless.kicker}</p>
        <h2>{t.wireless.title}</h2>
        <p>{t.wireless.copy}</p>
      </div>
      <div className="connection-rail">
        <div><Cable /><strong>{t.wireless.wired}</strong><span>{t.wireless.wiredMeta}</span></div>
        <div><Radio /><strong>{t.wireless.radio}</strong><span>{t.wireless.radioMeta}</span></div>
        <div><Bluetooth /><strong>{t.wireless.bluetooth}</strong><span>{t.wireless.bluetoothMeta}</span></div>
      </div>
      <div className="battery-statement">
        <div><span>01</span><strong>{t.wireless.battery}</strong></div>
        <div><span>02</span><strong>{t.wireless.hours}</strong></div>
        <div><span>03</span><strong>{t.wireless.compatibility}</strong></div>
      </div>
    </section>
  );
}
