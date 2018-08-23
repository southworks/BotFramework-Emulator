echo Pack releases
cd ./packages/app/main/

npm version $TRAVIS_TAG

gulp clean
gulp stage:windows
gulp redist:windows-nsis:binaries

gulp clean
gulp stage:mac
gulp redist:mac:binaries

gulp clean
gulp stage:linux
gulp redist:linux

cd ./dist/

echo Files to dist

ls -R

for filename in *; do
  echo $filename
done
