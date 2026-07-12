require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'FlightLiveActivity'
  s.version        = package['version'] || '1.0.0'
  s.summary        = 'JetSetter Pro Flight Live Activity (ActivityKit) bridge'
  s.description    = 'Start/update/end a flight Live Activity from JS.'
  s.author         = 'JetSetter Pro'
  s.homepage       = 'https://jetsetter.pro'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
