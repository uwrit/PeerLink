import ithsLogo from "../../assets/iths_logo_white.png";
import uwMedicineLogo from "../../assets/uw_medicine_logo.png";

export function Footer() {
  return (
    <footer className="bg-[#262626] text-white px-8 py-10">
      <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
        <div className="flex flex-col gap-6 flex-shrink-0 items-center">
          <img
            src={ithsLogo}
            alt="Institute of Translational Health Sciences"
            className="h-14 w-auto object-contain"
          />
          <img
            src={uwMedicineLogo}
            alt="University of Washington School of Medicine"
            className="h-22 w-auto object-contain"
          />
        </div>

        <div className="flex-1 md:border-l md:border-white/20 md:pl-12">
          <h3 className="text-lg font-semibold mb-3 text-white">
            About PeerLink
          </h3>
          <p className="text-sm leading-relaxed text-white/80 max-w-2xl">
            PeerLink is a reviewer matching tool developed in collaboration with
            the Institute of Translational Health Sciences (ITHS) and a group of
            students at the Information School (iSchool) at the University of
            Washington. This project was developed as a part of the iSchool's
            Capstone Program in 2026. To learn more about the iSchool's Capstone
            Program, please visit{" "}
            <a
              href="https://ischool.uw.edu/capstone"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              https://ischool.uw.edu/capstone.
            </a>
            {" "}This website is currently maintained by{" "}
            <a
              href="https://rit.uw.edu/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              UW Medicine Research IT.
            </a>
            {" "} <br /> Created by Amrith Gandham, Aradhana Muthabatulla, Liya Hutchison,
            Rohan Simha, and Mykyta Lepikash.
          </p>
          <p className="text-xs text-white/50 mt-4">
            &copy; {new Date().getFullYear()} PeerLink.
          </p>
        </div>
      </div>
    </footer>
  );
}
