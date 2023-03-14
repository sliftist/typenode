import { forceTransformPackage } from "./compileFixESMTS";
forceTransformPackage("ol");
import * as ol from "ol";
console.log(ol);