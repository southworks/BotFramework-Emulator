echo Pack releases
cd ./packages/app/main/
gulp package:windows-nsis:binaries
gulp package:mac:binaries
gulp package:linux
cd ./dist/

for filename in *; do
  echo $filename
done
