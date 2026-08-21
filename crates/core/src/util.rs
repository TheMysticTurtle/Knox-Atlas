//! Small shared parsing helpers for the XML sources.

use quick_xml::events::BytesStart;

pub(crate) fn attribute(element: &BytesStart<'_>, key: &[u8]) -> Option<String> {
    element.attributes().flatten().find_map(|attribute| {
        (attribute.key.as_ref() == key)
            .then(|| xml_decode(&String::from_utf8_lossy(attribute.value.as_ref())))
    })
}

pub(crate) fn xml_decode(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

pub(crate) fn parse_f32(value: Option<String>) -> f32 {
    value.and_then(|value| value.parse().ok()).unwrap_or(0.0)
}
